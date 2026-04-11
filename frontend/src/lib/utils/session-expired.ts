/**
 * Centralized session-expired handling.
 *
 * Previously duplicated across 15 route-level API files.
 * Provides consistent SESSION_EXPIRED error detection and redirect.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

/** Check if an error is a SESSION_EXPIRED response from the backend. */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/** Redirect to login page with session=expired query param. */
export function handleSessionExpired(): void {
  void goto(resolve('/login?session=expired'));
}

/** Check for session expired and redirect if so. Returns true if expired. */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}
