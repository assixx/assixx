/**
 * Safely extracts an error message from an unknown catch variable.
 *
 * Handles Error instances, strings, and arbitrary thrown values.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}
