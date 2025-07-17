/**
 * Path Security Utilities
 * Provides functions for secure path handling to prevent path injection attacks
 */

import path from "path";
import { logger } from "./logger";

/**
 * Validates and sanitizes a file path to prevent directory traversal attacks
 * @param filePath - The file path to validate
 * @param baseDir - The base directory that the path must be within
 * @returns The normalized absolute path if valid, null if invalid
 */
export function validatePath(filePath: string, baseDir: string): string | null {
  try {
    // Normalize and resolve the paths
    const normalizedBase = path.resolve(baseDir);
    const normalizedPath = path.resolve(baseDir, filePath);

    // Check if the resolved path is within the base directory
    if (!normalizedPath.startsWith(normalizedBase)) {
      logger.warn(`Path traversal attempt detected: ${filePath}`);
      return null;
    }

    // Additional checks for common path injection patterns
    const dangerousPatterns = [
      /\.\.[/\\]/, // Directory traversal
      /^[/\\]/, // Absolute paths
      /\0/, // Null bytes
      /%2e%2e/i, // URL encoded traversal
      /%252e%252e/i, // Double URL encoded traversal
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        logger.warn(`Dangerous path pattern detected: ${filePath}`);
        return null;
      }
    }

    return normalizedPath;
  } catch (error) {
    logger.error(`Error validating path: ${error}`);
    return null;
  }
}

/**
 * Sanitizes a filename to prevent path injection
 * @param filename - The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators and dangerous characters
  let sanitized = filename
    .replace(/[/\\]/g, "_") // Replace path separators
    .replace(/\.\./g, "_") // Replace directory traversal
    .replace(/[<>:"|?*\0]/g, "_") // Replace illegal characters
    .replace(/^\.+/, "_") // Replace leading dots
    .trim();

  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized === "_") {
    sanitized = `file_${Date.now()}`;
  }

  // Limit filename length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Creates a secure file path within a base directory
 * @param baseDir - The base directory
 * @param filename - The filename to use
 * @returns The secure file path
 */
export function createSecurePath(baseDir: string, filename: string): string {
  const sanitizedFilename = sanitizeFilename(filename);

  // Validate the final path
  const validated = validatePath(sanitizedFilename, baseDir);
  if (!validated) {
    throw new Error("Invalid file path");
  }

  return validated;
}

/**
 * Checks if a file extension is allowed
 * @param filename - The filename to check
 * @param allowedExtensions - Array of allowed extensions (e.g., ['.pdf', '.jpg'])
 * @returns True if the extension is allowed
 */
export function isAllowedExtension(
  filename: string,
  allowedExtensions: string[],
): boolean {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Gets the upload directory for a specific type
 * @param type - The upload type (e.g., 'documents', 'profile_pictures')
 * @returns The absolute path to the upload directory
 */
export function getUploadDirectory(type: string): string {
  const baseUploadDir = path.resolve(process.cwd(), "uploads");

  const uploadDirs: Record<string, string> = {
    documents: path.join(baseUploadDir, "documents"),
    profile_pictures: path.join(baseUploadDir, "profile_pictures"),
    blackboard: path.join(baseUploadDir, "blackboard"),
    chat: path.join(baseUploadDir, "chat"),
    kvp: path.join(baseUploadDir, "kvp"),
  };

  const dir = uploadDirs[type];
  if (!dir) {
    throw new Error(`Invalid upload type: ${type}`);
  }

  return dir;
}

/**
 * Safely deletes a file, ensuring it's within the uploads directory
 * @param filePath - The file path to delete
 * @returns True if file was deleted, false otherwise
 */
export async function safeDeleteFile(filePath: string): Promise<boolean> {
  try {
    // Validate the path is within the uploads directory
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const validatedPath = validatePath(filePath, process.cwd());

    if (!validatedPath?.startsWith(uploadsDir)) {
      logger.warn(
        `Attempted to delete file outside uploads directory: ${filePath}`,
      );
      return false;
    }

    // Check if file exists before attempting to delete
    const fs = await import("fs/promises");
    try {
      await fs.access(validatedPath);
      await fs.unlink(validatedPath);
      logger.info(`Successfully deleted file: ${validatedPath}`);
      return true;
    } catch {
      // File doesn't exist or can't be accessed
      logger.warn(`File not found or inaccessible: ${validatedPath}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error in safeDeleteFile: ${error}`);
    return false;
  }
}
