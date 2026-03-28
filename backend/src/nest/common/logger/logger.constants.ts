/**
 * Pino Logger Constants
 *
 * Centralized configuration for logging redaction paths and settings.
 * Migrated from Winston's sanitizeForLog() to Pino's built-in redaction.
 */

/**
 * Paths to redact in logs (Pino redaction syntax)
 * Supports nested paths with dot notation and array wildcards [*]
 *
 * @see https://github.com/pinojs/pino/blob/main/docs/redaction.md
 */
export const REDACT_PATHS: readonly string[] = [
  // Auth headers
  'req.headers.authorization',
  'req.headers.cookie',

  // Auth body fields (login, signup, password change)
  'req.body.password',
  'req.body.adminPassword',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.passwordConfirm',
  'req.body.confirmPassword',

  // Token fields
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',

  // Response tokens
  'res.body.accessToken',
  'res.body.refreshToken',
  'res.body.data.accessToken',
  'res.body.data.refreshToken',

  // General sensitive data - wildcards for nested objects
  // Level 1: { password: 'x' }
  'password',
  'secret',
  'apiKey',
  'token',
  'authorization',

  // Level 2: { user: { password: 'x' } }
  '*.password',
  '*.secret',
  '*.apiKey',
  '*.token',
  '*.authorization',

  // Level 3: { data: { user: { password: 'x' } } }
  '*.*.password',
  '*.*.secret',
  '*.*.apiKey',
  '*.*.token',
  '*.*.authorization',

  // Level 4: { response: { data: { user: { password: 'x' } } } }
  '*.*.*.password',
  '*.*.*.secret',
  '*.*.*.apiKey',
  '*.*.*.token',
  '*.*.*.authorization',
] as const;

/**
 * Redaction placeholder for sensitive values
 */
export const REDACTED_VALUE = '[REDACTED]';

/**
 * Log levels by environment
 */
/**
 * Default log levels by environment.
 * INFO is the standard for both production AND development.
 * DEBUG is only enabled via explicit LOG_LEVEL=debug env var when troubleshooting.
 *
 * Best Practice:
 * - INFO: Significant events (login, create, delete, errors)
 * - DEBUG: Only for active troubleshooting, not default
 */
export const LOG_LEVELS = {
  production: 'info',
  development: 'info', // Changed from 'debug' - DEBUG via LOG_LEVEL=debug only
  test: 'silent',
} as const;

/**
 * Routes to exclude from request logging
 * (health checks, metrics, etc.)
 *
 * Used by both:
 * 1. nestjs-pino exclude (NestJS route matching - without global prefix)
 * 2. pino-http autoLogging.ignore (full URL path matching)
 */
export const EXCLUDED_ROUTES = [
  { method: 'GET' as const, path: 'health' },
  { method: 'GET' as const, path: 'metrics' },
] as const;

/**
 * Full URL paths to exclude from pino-http autoLogging
 * These are matched against req.url (includes global prefix)
 */
export const EXCLUDED_URL_PATHS: readonly string[] = [
  '/health',
  '/api/v2/health',
  '/api/v2/metrics',
] as const;

/**
 * Loki configuration for pino-loki transport
 * Supports both self-hosted Loki and Grafana Cloud
 *
 * Self-hosted: LOKI_URL=http://loki:3100
 * Grafana Cloud: LOKI_URL=https://logs-prod-XX.grafana.net + GRAFANA_CLOUD_USER + GRAFANA_CLOUD_API_KEY
 */
export const LOKI_CONFIG = {
  /** Default Loki URL (Docker network) */
  defaultUrl: 'http://loki:3100',
  /** API endpoint for pushing logs */
  endpoint: '/loki/api/v1/push',
  /** Batching configuration */
  batching: {
    /** Send logs every N seconds */
    interval: 5,
    /** Maximum logs in buffer before force-send */
    maxBufferSize: 10000,
  },
  /** Labels attached to all logs */
  labels: {
    app: 'assixx',
    service: 'backend',
  },
} as const;

/**
 * Get Grafana Cloud basicAuth configuration if credentials are set
 * Returns undefined for self-hosted Loki (no auth needed)
 */
export function getGrafanaCloudAuth(): { username: string; password: string } | undefined {
  const userId = process.env['GRAFANA_CLOUD_USER'];
  const apiKey = process.env['GRAFANA_CLOUD_API_KEY'];

  if (userId !== undefined && userId !== '' && apiKey !== undefined && apiKey !== '') {
    return {
      username: userId,
      password: apiKey,
    };
  }

  return undefined;
}
