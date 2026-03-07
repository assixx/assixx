/**
 * Safely extracts an error message from an unknown catch variable.
 *
 * Handles Error instances, strings, and arbitrary thrown values.
 * Frontend equivalent of backend's error.utils.ts.
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = 'Unknown error',
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}
