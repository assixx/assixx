/**
 * Pino Logger Configuration
 *
 * Standalone Pino logger for use outside NestJS context.
 * For NestJS services, use the Logger from \@nestjs/common instead (backed by nestjs-pino).
 *
 * Use cases:
 * - Database connection (before NestJS bootstrap)
 * - Redis connection (before NestJS bootstrap)
 * - Worker processes (deletionWorker.ts)
 * - Standalone scripts
 *
 * Features:
 * - Development: pino-pretty for readable output
 * - Production: JSON to stdout + pino-loki to Grafana Loki
 * - Dual Loki support: Local (Docker) + Grafana Cloud simultaneously
 *
 * Environment Variables:
 * - LOKI_URL: Grafana Cloud Loki URL (with GRAFANA_CLOUD_USER/API_KEY)
 * - LOKI_LOCAL_URL: Local Docker Loki URL (default: loki on port 3100)
 *
 * @see docs/PINO-LOGGING-PLAN.md
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import pino from 'pino';

import {
  LOKI_CONFIG,
  REDACTED_VALUE,
  REDACT_PATHS,
  getGrafanaCloudAuth,
} from '../nest/common/logger/logger.constants.js';

/**
 * Determine if we're in production environment
 */
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Loki configuration for dual-target logging
 */
interface LokiTargetConfig {
  url: string;
  basicAuth?: { username: string; password: string };
  label: string; // 'cloud' or 'local' for identification
}

/**
 * Get all configured Loki targets (supports dual logging: local + cloud)
 */
function getLokiTargets(): LokiTargetConfig[] {
  const targets: LokiTargetConfig[] = [];

  // 1. Grafana Cloud Loki (LOKI_URL with auth)
  const cloudUrl = process.env['LOKI_URL'];
  const basicAuth = getGrafanaCloudAuth();
  if (cloudUrl !== undefined && cloudUrl !== '' && basicAuth !== undefined) {
    targets.push({
      url: cloudUrl,
      basicAuth,
      label: 'cloud',
    });
  }

  // 2. Local Docker Loki (LOKI_LOCAL_URL, no auth)
  const localUrl = process.env['LOKI_LOCAL_URL'];
  if (localUrl !== undefined && localUrl !== '') {
    targets.push({
      url: localUrl,
      label: 'local',
    });
  }

  // Fallback: If no targets configured but in production, use default local
  if (targets.length === 0 && isProduction) {
    targets.push({
      url: LOKI_CONFIG.defaultUrl,
      label: 'local',
    });
  }

  return targets;
}

/**
 * Get log level based on environment
 */
function getLogLevel(): string {
  if (process.env['LOG_LEVEL'] !== undefined) {
    return process.env['LOG_LEVEL'];
  }
  if (isProduction) return 'info';
  if (process.env['NODE_ENV'] === 'test') return 'silent';
  return 'debug';
}

/**
 * Build Loki transport targets from configuration
 */
function buildLokiTransportTargets(
  level: string,
): pino.TransportTargetOptions[] {
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
        loki_target: target.label, // 'cloud' or 'local' for debugging
      },
    },
    level,
  }));
}

/**
 * Build transport configuration based on environment
 *
 * Development: pino-pretty + Loki targets (if configured)
 * Production: stdout (JSON) + Loki targets
 *
 * Supports dual Loki: local Docker Loki + Grafana Cloud simultaneously
 */
function buildTransport():
  | pino.TransportSingleOptions
  | pino.TransportMultiOptions
  | undefined {
  const lokiTargets = getLokiTargets();
  const hasLokiTargets = lokiTargets.length > 0;

  // Development mode
  if (!isProduction) {
    // With Loki targets: pino-pretty + all Loki targets
    if (hasLokiTargets) {
      return {
        targets: [
          // Console output (pino-pretty)
          {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
            level: 'debug',
          },
          // All configured Loki targets (local + cloud)
          ...buildLokiTransportTargets('debug'),
        ],
      };
    }

    // Without Loki: just pino-pretty
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  // Production without Loki: no transport (JSON to stdout)
  if (!hasLokiTargets) {
    return undefined;
  }

  // Production with Loki: stdout (JSON) + all Loki targets
  return {
    targets: [
      // Stdout for Docker logs (JSON format)
      {
        target: 'pino/file',
        options: { destination: 1 }, // 1 = stdout
        level: 'info',
      },
      // All configured Loki targets (local + cloud)
      ...buildLokiTransportTargets('info'),
    ],
  };
}

/**
 * Build logger options based on environment
 */
function buildLoggerOptions(): pino.LoggerOptions {
  const transport = buildTransport();
  const baseOptions: pino.LoggerOptions = {
    level: getLogLevel(),
    // Redaction for sensitive data
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACTED_VALUE,
    },
    // Base context
    base: {
      service: 'assixx-backend',
    },
  };

  // Only add transport if it's defined
  if (transport !== undefined) {
    return { ...baseOptions, transport };
  }

  return baseOptions;
}

/**
 * Standalone Pino logger instance
 *
 * @example
 * ```typescript
 * import \{ logger \} from '../utils/logger.js';
 * logger.info('Database connected');
 * logger.error(\{ err \}, 'Connection failed');
 * ```
 */
export const logger = pino(buildLoggerOptions());

/**
 * Create a child logger with context
 *
 * @example
 * ```typescript
 * const dbLogger = createLogger('Database');
 * dbLogger.info('Query executed');
 * ```
 */
export function createLogger(context: string): pino.Logger {
  return logger.child({ context });
}
