/**
 * Secret Loading Utilities
 *
 * Supports two modes for loading secrets:
 * 1. Direct environment variable (development)
 * 2. File-based secrets via _FILE suffix (production/Docker Secrets)
 *
 * This follows the same pattern as official Docker images (postgres, mysql).
 *
 * Usage:
 *   // In docker-compose.yml:
 *   JWT_SECRET_FILE: /run/secrets/jwt_secret
 *
 *   // In code:
 *   const jwtSecret = readSecret('JWT_SECRET');
 *   // Will check JWT_SECRET_FILE first, then JWT_SECRET
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';

/**
 * Validates that a secret value meets minimum length requirement
 * @throws Error if value is too short
 */
function validateMinLength(value: string, name: string, minLength: number, source?: string): void {
  if (minLength > 0 && value.length < minLength) {
    const location = source !== undefined ? ` (from file ${source})` : '';
    throw new Error(`Secret ${name}${location} must be at least ${minLength} characters`);
  }
}

/**
 * Attempts to read a secret from a file path specified in environment variable
 * @returns The secret value or null if no file path is configured
 * @throws Error if file path is invalid or file doesn't exist
 */
function tryReadFromFile(name: string, minLength: number): string | null {
  const fileEnvVar = `${name}_FILE`;
  const filePath = process.env[fileEnvVar];

  if (filePath === undefined || filePath === '') {
    return null;
  }

  // Validate path is absolute to prevent relative path traversal
  if (!isAbsolute(filePath)) {
    throw new Error(`Secret file path must be absolute: ${filePath} (from ${fileEnvVar})`);
  }

  // Normalize to resolve any .. segments
  const normalizedPath = normalize(filePath);

  // Security: Path comes from environment variable set by system administrators
  // at deployment time (Docker secrets), not from user input. This is the standard
  // pattern used by official Docker images (postgres, mysql, etc.).
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- deployment config, not user input
  if (!existsSync(normalizedPath)) {
    throw new Error(`Secret file not found: ${normalizedPath} (from ${fileEnvVar})`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- deployment config, not user input
  const value = readFileSync(normalizedPath, 'utf8').trim();
  validateMinLength(value, name, minLength, normalizedPath);
  return value;
}

/**
 * Attempts to read a secret from a direct environment variable
 * @returns The secret value or null if not set
 */
function tryReadFromEnv(name: string, minLength: number): string | null {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return null;
  }

  validateMinLength(value, name, minLength);
  return value;
}

/**
 * Read a secret from environment variable or file
 *
 * Order of precedence:
 * 1. NAME_FILE environment variable pointing to a file
 * 2. NAME environment variable directly
 *
 * @param name - Base name of the secret (e.g., 'JWT_SECRET')
 * @param options - Configuration options
 * @returns The secret value
 * @throws Error if secret is not found and required
 */
export function readSecret(
  name: string,
  options: {
    required?: boolean;
    minLength?: number;
    defaultValue?: string;
  } = {},
): string {
  const { required = true, minLength = 0, defaultValue } = options;

  // Try file-based secret first (_FILE suffix)
  const fileValue = tryReadFromFile(name, minLength);
  if (fileValue !== null) {
    return fileValue;
  }

  // Try direct environment variable
  const envValue = tryReadFromEnv(name, minLength);
  if (envValue !== null) {
    return envValue;
  }

  // Use default value if provided
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  // Required check
  if (required) {
    const fileEnvVar = `${name}_FILE`;
    throw new Error(
      `Required secret ${name} not found. ` +
        `Set ${name} environment variable or ${fileEnvVar} pointing to a file.`,
    );
  }

  return '';
}

/**
 * Read an optional secret
 * Returns undefined if not found instead of throwing
 */
export function readOptionalSecret(
  name: string,
  options: { minLength?: number } = {},
): string | undefined {
  try {
    const result = readSecret(name, { ...options, required: false });
    return result !== '' ? result : undefined;
  } catch {
    return undefined;
  }
}
