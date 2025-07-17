/**
 * Error handling utilities for consistent error processing
 */

/**
 * Get error message from unknown error type
 * @param error - The error object (can be any type)
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

/**
 * Get error stack trace from unknown error type
 * @param error - The error object (can be any type)
 * @returns Stack trace or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error is a specific error type
 * @param error - The error object
 * @param code - The error code to check for
 * @returns True if error has the specified code
 */
export function isErrorWithCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}

/**
 * Type guard for database errors
 */
export function isDatabaseError(
  error: unknown
): error is { code: string; errno?: number; sqlMessage?: string } {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}
