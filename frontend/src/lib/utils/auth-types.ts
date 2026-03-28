/**
 * Shared authentication types
 *
 * PURPOSE: Decouples api-client and token-manager to prevent import cycles.
 * Both modules can import types from here without creating dependencies on each other.
 */

/**
 * Reason for logout - determines redirect behavior and messaging
 */
export type LogoutReason = 'logout' | 'inactivity_timeout' | 'token_expired' | 'refresh_failed';
