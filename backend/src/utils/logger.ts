/**
 * Logger Configuration
 * Winston-based logging system with file rotation and console output
 */
import path from 'path';
import winston from 'winston';

// Define log directory using process.cwd() for compatibility with both ESM and CommonJS
const logDir = path.join(process.cwd(), 'logs');

// Log levels interface - Unused
// interface LogLevel {
//   error: string;
//   warn: string;
//   info: string;
//   http: string;
//   verbose: string;
//   debug: string;
//   silly: string;
// }

// Custom metadata interface
type LogMetadata = Record<string, string | number | boolean | null | undefined | object>;

// Custom format for better readability
const customFormat = winston.format.printf(
  ({ level, message, timestamp, ...metadata }: winston.Logform.TransformableInfo) => {
    let msg = `${String(timestamp)} [${level.toUpperCase()}]: ${String(message)}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  },
);

// Logger configuration interface
interface LoggerConfig {
  level: string;
  format: winston.Logform.Format;
  defaultMeta: LogMetadata;
  transports: winston.transport[];
}

// Create logger instance
const logger: winston.Logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat,
  ),
  defaultMeta: { service: 'assixx-backend' } as LogMetadata,
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
} as LoggerConfig);

// Console logging for development
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

// Export logger instance with typed methods
export { logger };

// ========================================
// SECURITY: Sensitive Data Sanitization
// ========================================

/**
 * List of sensitive field names that should be redacted from logs
 * Case-insensitive matching is applied
 */
const SENSITIVE_FIELDS: readonly string[] = [
  'password',
  'adminPassword',
  'currentPassword',
  'newPassword',
  'passwordConfirm',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
] as const;

/**
 * Redaction placeholder for sensitive values
 */
const REDACTED = '[REDACTED]';

/**
 * Check if a field name is sensitive and should be redacted
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(
    (sensitiveField: string) => lowerFieldName === sensitiveField.toLowerCase(),
  );
}

/**
 * Sanitize a single value based on key sensitivity
 */
function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (isSensitiveField(key) && value !== undefined && value !== null) {
    return REDACTED;
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeForLog(value, depth - 1);
  }
  return value;
}

/**
 * Recursively sanitize an object by redacting sensitive fields
 * CRITICAL: Use this before logging any user input or request data
 *
 * @param obj - Object to sanitize (can be any type)
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 10)
 * @returns Sanitized copy of the object with sensitive fields redacted
 *
 * @example
 * ```typescript
 * const userData = { email: 'user@test.de', password: 'secret123' };
 * logger.info('User data:', sanitizeForLog(userData));
 * // Output: { email: 'user@test.de', password: '[REDACTED]' }
 * ```
 */
export function sanitizeForLog<T>(obj: T, maxDepth: number = 10): T {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives (string, number, boolean)
  if (typeof obj !== 'object') {
    return obj;
  }

  // Prevent infinite recursion
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_REACHED]' as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => sanitizeForLog(item, maxDepth - 1)) as T;
  }

  // Handle objects - build sanitized copy
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key comes from Object.entries of input obj
    sanitized[key] = sanitizeValue(key, value, maxDepth);
  }

  return sanitized as T;
}

// Default export
